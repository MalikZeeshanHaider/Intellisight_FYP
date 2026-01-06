import express from "express";
import { main,register, login, logout, signupPage, loginPage, forgotPasswordPage, refreshToken, forgotpassword , resetPassword,resetpassword,verifyUser } from "../controllers/auth.controller.js";

const router = express.Router();

router.get("/", main);
router.get("/login", loginPage);
router.get("/signup", signupPage);
router.get("/forgotpassword", forgotPasswordPage);
router.get("/reset-password/:token", resetpassword);

router.post("/register", register);
router.get("/verify-user/:token/:action", verifyUser);

router.post("/login", login);
router.post("/token", refreshToken);
router.post("/logout", logout);
router.post("/forgotpassword", forgotpassword);
router.post("/reset-password/:token", resetPassword);

export default router;
