import { Router, type IRouter } from "express";
import healthRouter from "./health";
import controlRouter from "./control";
import catalogRouter from "./catalog";

const router: IRouter = Router();

router.use(healthRouter);
router.use(controlRouter);
router.use(catalogRouter);

export default router;
