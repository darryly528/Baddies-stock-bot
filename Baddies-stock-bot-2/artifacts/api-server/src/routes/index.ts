import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import listingsRouter from "./listings";
import authRouter from "./auth";
import controlRouter from "./control";
import messagesRouter from "./messages";
import checkoutRouter from "./checkout";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(catalogRouter);
router.use(listingsRouter);
router.use(controlRouter);
router.use(messagesRouter);
router.use(checkoutRouter);

export default router;
