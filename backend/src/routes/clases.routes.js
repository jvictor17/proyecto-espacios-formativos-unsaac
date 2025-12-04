// src/routes/clases.routes.js
import { Router } from "express";
import claseController from "../controllers/clase.controller.js";

const router = Router();

router.get("/", claseController.getAll);
router.get("/:id", claseController.getById);
router.post("/", claseController.create);
router.put("/:id", claseController.update);
router.delete("/:id", claseController.remove);

export default router;
