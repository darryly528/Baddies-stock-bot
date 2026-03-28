import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import listingsRouter from "./listings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(listingsRouter);

export default router;
