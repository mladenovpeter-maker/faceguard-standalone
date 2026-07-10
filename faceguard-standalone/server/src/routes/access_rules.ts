import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, accessRulesTable, employeesTable, zonesTable } from "@workspace/db";
import {
  CreateAccessRuleBody,
  DeleteAccessRuleParams,
  ListAccessRulesResponse,
  CreateAccessRuleResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/access-rules", async (_req, res): Promise<void> => {
  const rules = await db
    .select({
      id: accessRulesTable.id,
      employeeId: accessRulesTable.employeeId,
      employeeName: employeesTable.firstName,
      employeeLastName: employeesTable.lastName,
      employeeNumber: employeesTable.employeeNumber,
      zoneId: accessRulesTable.zoneId,
      zoneName: zonesTable.name,
      createdAt: accessRulesTable.createdAt,
    })
    .from(accessRulesTable)
    .leftJoin(employeesTable, eq(accessRulesTable.employeeId, employeesTable.id))
    .leftJoin(zonesTable, eq(accessRulesTable.zoneId, zonesTable.id))
    .orderBy(accessRulesTable.createdAt);

  const formatted = rules.map((r) => ({
    ...r,
    employeeName: r.employeeName && r.employeeLastName ? `${r.employeeName} ${r.employeeLastName}` : null,
    employeeLastName: undefined,
  }));

  res.json(ListAccessRulesResponse.parse(formatted));
});

router.post("/access-rules", async (req, res): Promise<void> => {
  const parsed = CreateAccessRuleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [rule] = await db.insert(accessRulesTable).values({
    employeeId: parsed.data.employeeId,
    zoneId: parsed.data.zoneId,
  }).returning();

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, rule.employeeId));
  const [zone] = await db.select().from(zonesTable).where(eq(zonesTable.id, rule.zoneId));

  const result = {
    ...rule,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}` : null,
    employeeNumber: emp?.employeeNumber ?? null,
    zoneName: zone?.name ?? null,
  };

  res.status(201).json(CreateAccessRuleResponse.parse(result));
});

router.delete("/access-rules/:id", async (req, res): Promise<void> => {
  const params = DeleteAccessRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [rule] = await db
    .delete(accessRulesTable)
    .where(eq(accessRulesTable.id, params.data.id))
    .returning();

  if (!rule) {
    res.status(404).json({ error: "Access rule not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
