import { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIVE_INT_REGEX = /^[1-9]\d*$/;

export const verifyOwnershipOrAdmin = async (
  request: Request,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!request.user || !request.user.idUser) {
      response.status(401).json({
        status: false,
        message: "Unauthorized"
      });
      return;
    }

    const rawIdUser = Array.isArray(request.params.idUser)
      ? request.params.idUser[0]
      : request.params.idUser;

    const idUser = rawIdUser?.trim();

    if (!idUser) {
      response.status(400).json({
        status: false,
        message: "User identifier is required."
      });
      return;
    }

    const isUuid = UUID_REGEX.test(idUser);
    const isNumeric = POSITIVE_INT_REGEX.test(idUser);

    if (!isUuid && !isNumeric) {
      response.status(400).json({
        status: false,
        message: "Invalid user identifier format."
      });
      return;
    }

    const targetUser = await prisma.user.findFirst({
      where: isUuid ? { uuid: idUser } : { id: Number(idUser) },
      select: { id: true, uuid: true }
    });

    if (!targetUser) {
      response.status(404).json({
        status: false,
        message: "User not found."
      });
      return;
    }

    const requesterId = request.user.idUser;
    const isRequesterAdmin = request.user.role === "ADMIN";

    if (isRequesterAdmin || requesterId === targetUser.id) {
      next();
      return;
    }

    response.status(403).json({
      status: false,
      message: "You can only access your own data"
    });
  } catch (error) {
    console.error("[verifyOwnershipOrAdmin]", error);
    response.status(500).json({
      status: false,
      message: "Internal server error."
    });
  }
};

// verifyOwnership: used by admin-only routes that need to confirm admin identity
export const verifyOwnership = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  if (!request.admin) {
    return response.status(401).json({
      status: false,
      message: "Unauthorized"
    });
  }

  // Now admin payload uses idUser (maps to admin.id) for unified JWT
  const requesterId = request.admin.idUser;
  const targetId    = Number(request.params.idAdmin);

  if (Number.isNaN(targetId)) {
    return response.status(400).json({
      status: false,
      message: "ID must be a number."
    });
  }

  if (requesterId !== targetId) {
    return response.status(403).json({
      status: false,
      message: "You can only access your own profile."
    });
  }

  next();
};
