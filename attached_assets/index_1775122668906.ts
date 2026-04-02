import { Router, type IRouter } from "express";
import healthRouter from "./health";
import controlRouter from "./control";

const router: IRouter = Router();

router.use(healthRouter);
router.use(controlRouter);

export default router;
