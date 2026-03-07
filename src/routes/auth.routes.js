import express from "express";
import {
  loginAdmin,
  logoutAdmin,
  getMeAdmin,
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login", loginAdmin);
router.post("/logout", logoutAdmin);
router.get("/me", getMeAdmin);

export default router;