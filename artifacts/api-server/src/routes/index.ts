import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import employeesRouter from "./employees";
import zonesRouter from "./zones";
import camerasRouter from "./cameras";
import accessRulesRouter from "./access_rules";
import recognitionsRouter from "./recognitions";
import attendanceRouter from "./attendance";
import dashboardRouter from "./dashboard";
import leavesRouter from "./leaves";
import zoneSchedulesRouter from "./zone_schedules";
import departmentsRouter from "./departments";
import departmentSchedulesRouter from "./department_schedules";
import form76Router from "./form76";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(employeesRouter);
router.use(zonesRouter);
router.use(camerasRouter);
router.use(accessRulesRouter);
router.use(recognitionsRouter);
router.use(attendanceRouter);
router.use(dashboardRouter);
router.use(leavesRouter);
router.use(zoneSchedulesRouter);
router.use(departmentsRouter);
router.use(departmentSchedulesRouter);
router.use(form76Router);

export default router;
