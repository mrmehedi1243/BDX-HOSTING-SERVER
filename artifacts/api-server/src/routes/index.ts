import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plansRouter from "./plans";
import usersRouter from "./users";
import serversRouter from "./servers";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plansRouter);
router.use(usersRouter);
router.use(serversRouter);
router.use(dashboardRouter);

export default router;
