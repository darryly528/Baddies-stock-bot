import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import listingsRouter from "./listings";
import authRouter from "./auth";
import controlRouter from "./control";
import messagesRouter from "./messages";
import adminRouter from "./admin";
import staffRouter from "./staff";
import profilesRouter from "./profiles";
import ticketsRouter from "./tickets";
import presenceRouter from "./presence";
import uploadsRouter from "./uploads";
import vouchesRouter from "./vouches";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(catalogRouter);
router.use(listingsRouter);
router.use(controlRouter);
router.use(messagesRouter);
router.use(adminRouter);
router.use(staffRouter);
router.use(profilesRouter);
router.use(ticketsRouter);
router.use(presenceRouter);
router.use(uploadsRouter);
router.use(vouchesRouter);
router.use(reportsRouter);

export default router;
