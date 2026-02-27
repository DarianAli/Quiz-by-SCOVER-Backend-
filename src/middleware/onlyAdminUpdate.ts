import { Request, Response, NextFunction } from "express";


export const onlyAdminCanChangeRole = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requester = req.user;

  if (req.body.role !== undefined) {
    if (requester?.role !== "ADMIN") {
      return res.status(403).json({
        status: false,
        message: "Only admin can change role"
      });
    }
  }

  next();
};