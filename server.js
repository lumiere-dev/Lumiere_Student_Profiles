import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const BASE_ID = "appOhh4711y4cXSfj";
const TABLE_ID = "tbl86VUnRDEiBphrL";
const FIELDS = [
  "Student Name", "Cohort of Program", "Graduation Year",
  "Journal of Acceptance (Text)", "Journal of Resubmission (Text)", "PM: Research Question",
  "Research Field", "Country", "Vertical", "ISEF Status",
  "Link to Publication", "ISEF Publication Link",
  "Link to Journal of Publication Website",
  "School Grade (Text)", "Program Type",
  "Mentor Name",
  "Mentor University",
  "Mentor Highest Degree Type",
];
const REC_ID_RE = /^rec[A-Za-z0-9]{14}$/;

// Lookups return one value per linked record; some are empty. Drop the blanks
// before joining so we don't get artifacts like ", , https://…" from empty slots.
const clean = (val) => {
  if (Array.isArray(val)) {
    val = val.filter((v) => v != null && String(v).trim() !== "").join(", ");
  }
  val = (val || "").toString().trim();
  return REC_ID_RE.test(val) ? "" : val;
};

// Serve the static frontend (index.html, css, js, logo, etc.)
// Put those files in a folder named "public" next to this server.js.
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/data", async (req, res) => {
  const TOKEN = process.env.AIRTABLE_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({ error: "AIRTABLE_TOKEN is not set for this environment" });
  }

  let records = [];
  let offset;

  try {
    do {
      const params = new URLSearchParams({
        filterByFormula: "{Profile Status}='Accepted'",
        pageSize: "100",
        ...(offset && { offset }),
      });
      FIELDS.forEach((f) => params.append("fields[]", f));

      const resp = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params}`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      if (!resp.ok) {
        return res.status(502).json({ error: "Airtable error" });
      }

      const body = await resp.json();
      for (const rec of body.records || []) {
        const f = rec.fields;
        records.push({
          id: rec.id,
          studentName: clean(f["Student Name"]),
          cohort: clean(f["Cohort of Program"]),
          graduationYear: f["Graduation Year"] || "",
          journal: clean(f["Journal of Acceptance (Text)"]),
          journalResubmission: clean(f["Journal of Resubmission (Text)"]),
          researchQuestion: clean(f["PM: Research Question"]),
          mentorField: clean(f["Research Field"]),
          country: clean(f["Country"]),
          vertical: clean(f["Vertical"]),
          isefStatus: clean(f["ISEF Status"]),
          publicationLink: clean(f["Link to Publication"]),
          isefPublicationLink: clean(f["ISEF Publication Link"]),
          journalWebsite: clean(f["Link to Journal of Publication Website"]),
          schoolGrade: clean(f["School Grade (Text)"]),
          programType: clean(f["Program Type"]),
          mentorName: clean(f["Mentor Name"]),
          mentorUniversity: clean(f["Mentor University"]),
          mentorDegreeType: clean(f["Mentor Highest Degree Type"]),
        });
      }
      offset = body.offset;
    } while (offset);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected server error" });
  }

  // Note: this header only matters if a CDN sits in front of Railway.
  // Railway itself has no edge cache, so this is a no-op on its own for now.
  res.set("Cache-Control", "s-maxage=300, stale-while-revalidate");
  res.json({ updatedAt: new Date().toISOString(), students: records });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
