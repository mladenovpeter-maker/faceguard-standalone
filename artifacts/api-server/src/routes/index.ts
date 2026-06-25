import { Router, type IRouter } from "express";
import healthRouter from "./health";
import employeesRouter from "./employees";
import zonesRouter from "./zones";
import camerasRouter from "./cameras";
import accessRulesRouter from "./access_rules";
import recognitionsRouter from "./recognitions";
import attendanceRouter from "./attendance";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(employeesRouter);
router.use(zonesRouter);
router.use(camerasRouter);
router.use(accessRulesRouter);
router.use(recognitionsRouter);
router.use(attendanceRouter);
router.use(dashboardRouter);

export default router;
