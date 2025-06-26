import { Response } from "express";

export const writeToCookie = (res:Response, dataName: string, data: string ) => {
    res.cookie(dataName, data, {
        secure:true,
        httpOnly:true,
        maxAge:30 * 24 * 60 * 60 * 1000
    })
}