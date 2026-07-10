import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc } from "drizzle-orm";
import { db, employeesTable, recognitionEventsTable, departmentsTable } from "@workspace/db";
import {
  ListEmployeesQueryParams,
  CreateEmployeeBody,
  GetEmployeeParams,
  UpdateEmployeeParams,
  UpdateEmployeeBody,
  DeleteEmployeeParams,
  ListEmployeesResponse,
  CreateEmployeeResponse,
  GetEmployeeResponse,
  UpdateEmployeeResponse,
  UploadEmployeePhotoParams,
  UploadEmployeePhotoBody,
  UploadEmployeePhotoResponse,
} from "@workspace/api-zod";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const photosDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads/photos");
fs.mkdirSync(photosDir, { recursive: true });

const employeeColumns = {
  id: employeesTable.id,
  firstName: employeesTable.firstName,
  lastName: employeesTable.lastName,
  employeeNumber: employeesTable.employeeNumber,
  departmentId: employeesTable.departmentId,
  departmentName: departmentsTable.name,
  position: employeesTable.position,
  email: employeesTable.email,
  phone: employeesTable.phone,
  photoUrl: employeesTable.photoUrl,
  status: employeesTable.status,
  hiredAt: employeesTable.hiredAt,
  createdAt: employeesTable.createdAt,
};

router.get("/employees", async (req, res): Promise<void> => {
  const query = ListEmployeesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { search, departmentId, status } = query.data;

  let conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(employeesTable.firstName, `%${search}%`),
        ilike(employeesTable.lastName, `%${search}%`),
        ilike(employeesTable.employeeNumber, `%${search}%`),
        ilike(departmentsTable.name, `%${search}%`),
      )
    );
  }

  if (departmentId != null) {
    conditions.push(eq(employeesTable.departmentId, departmentId));
  }

  if (status && status !== "all") {
    conditions.push(eq(employeesTable.status, status));
  }

  const employees = await db
    .select(employeeColumns)
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(employeesTable.createdAt));

  res.json(ListEmployeesResponse.parse(employees));
});

router.post("/employees", async (req, res): Promise<void> => {
  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [employee] = await db.insert(employeesTable).values({
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    employeeNumber: parsed.data.employeeNumber,
    departmentId: parsed.data.departmentId,
    position: parsed.data.position,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    hiredAt: parsed.data.hiredAt != null ? String(parsed.data.hiredAt) : null,
  }).returning({ id: employeesTable.id });

  const [created] = await db
    .select(employeeColumns)
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(eq(employeesTable.id, employee.id));

  res.status(201).json(CreateEmployeeResponse.parse(created));
});

router.get("/employees/:id", async (req, res): Promise<void> => {
  const params = GetEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [employee] = await db
    .select(employeeColumns)
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(eq(employeesTable.id, params.data.id));

  if (!employee) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.json(GetEmployeeResponse.parse(employee));
});

router.patch("/employees/:id", async (req, res): Promise<void> => {
  const params = UpdateEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: any = { ...parsed.data };
  if (updateData.hiredAt != null) updateData.hiredAt = String(updateData.hiredAt);

  const [existing] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  await db
    .update(employeesTable)
    .set(updateData)
    .where(eq(employeesTable.id, params.data.id));

  const [employee] = await db
    .select(employeeColumns)
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(eq(employeesTable.id, params.data.id));

  res.json(UpdateEmployeeResponse.parse(employee));
});

router.delete("/employees/:id", async (req, res): Promise<void> => {
  const params = DeleteEmployeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const empId = params.data.id;

  const [existing] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.id, empId));
  if (!existing) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  // Null out employee_id on recognition events (nullable FK, no cascade)
  await db.update(recognitionEventsTable).set({ employeeId: null }).where(eq(recognitionEventsTable.employeeId, empId));

  // Delete employee — attendance, leaves, access_rules cascade automatically
  await db.delete(employeesTable).where(eq(employeesTable.id, empId));

  res.sendStatus(204);
});

router.post("/employees/:id/photo", async (req, res): Promise<void> => {
  const params = UploadEmployeePhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UploadEmployeePhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const base64Data = parsed.data.photoBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const filename = `employee-${params.data.id}-${Date.now()}.jpg`;
  const filePath = path.join(photosDir, filename);
  fs.writeFileSync(filePath, buffer);

  const photoUrl = `/api/uploads/photos/${filename}`;

  const [existing] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  await db
    .update(employeesTable)
    .set({ photoUrl })
    .where(eq(employeesTable.id, params.data.id));

  const [employee] = await db
    .select(employeeColumns)
    .from(employeesTable)
    .leftJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
    .where(eq(employeesTable.id, params.data.id));

  res.json(UploadEmployeePhotoResponse.parse(employee));
});

export default router;
