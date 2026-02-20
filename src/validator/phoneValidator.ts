import { isValidPhoneNumber } from "libphonenumber-js";
import { Request, Response, NextFunction } from "express";

export const phoneValidation =
  (fields: string[]) =>
  (request: Request, response: Response, next: NextFunction) => {
    for (const field of fields) {
      const value = request.body[field];

      if (!value || !isValidPhoneNumber(value, "ID")) {
        response.status(400).json({
          status: false,
          message: `${field} is invalid`,
        });
        return
      }
    }
    next();
  };
