import { Request, Response, NextFunction } from "express";

export const verifyOwnershipOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requesterId = req.user?.idUser;
  const targetId = Number(req.params.idUser);

  if (req.user?.role === "ADMIN" || requesterId === targetId) {
    return next();
  }

    return res.status(403).json({
    status: false,
    message: "You can only access your own data"
  });
};
