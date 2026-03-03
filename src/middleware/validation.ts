import { Request, Response, NextFunction } from "express";

export const verifyOwnershipOrAdmin = (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const requesterId = request.user?.idUser;
  const targetId = Number(request.params.idUser);

  if (request.user?.role === "ADMIN" || requesterId === targetId) {
    return next();
  }

    return response.status(403).json({
    status: false,
    message: "You can only access your own data"
  });
};


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

  const requesterId = request.admin.idAdmin;
  const targetId = Number(request.params.idAdmin);

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
