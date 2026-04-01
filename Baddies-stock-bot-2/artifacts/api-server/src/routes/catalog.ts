import { Router, type IRouter } from "express";
import { catalog } from "../catalogUpdater";

const router: IRouter = Router();

router.get("/catalog/items", (req, res) => {
  const search = ((req.query["search"] as string) ?? "").toLowerCase().trim();
  const itemType = (req.query["itemType"] as string) ?? "";
  const category = (req.query["category"] as string) ?? "";
  const page = Math.max(1, parseInt((req.query["page"] as string) ?? "1") || 1);
  const limit = Math.min(100, Math.max(1, parseInt((req.query["limit"] as string) ?? "40") || 40));

  let filtered = catalog;

  if (search) {
    filtered = filtered.filter((i) => i.name.toLowerCase().includes(search));
  }
  if (itemType) {
    filtered = filtered.filter((i) => i.itemType === itemType);
  }
  if (category) {
    filtered = filtered.filter((i) => i.category === category);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const items = filtered.slice((page - 1) * limit, page * limit);

  res.json({ items, total, page, limit, totalPages });
});

router.get("/catalog/categories", (_req, res) => {
  const itemTypes = [...new Set(catalog.map((i) => i.itemType).filter(Boolean))].sort();
  const categories = [...new Set(catalog.map((i) => i.category).filter(Boolean))].sort() as string[];
  res.json({ itemTypes, categories });
});

export default router;
