const BASE_ID  = "appOhh4711y4cXSfj";
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
const clean = val => {
  if (Array.isArray(val)) val = val.join(", ");
  val = (val || "").toString().trim();
  return REC_ID_RE.test(val) ? "" : val;
};

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });

// Naming the export `onRequestGet` (rather than `onRequest`) means this
// function only answers GET requests; anything else gets Cloudflare's
// default 405, which is what we want here.
export async function onRequestGet(context) {
  const TOKEN = context.env.AIRTABLE_TOKEN;

  if (!TOKEN) {
    return json({ error: "AIRTABLE_TOKEN is not set for this environment" }, 500);
  }

  let records = [], offset;

  try {
    do {
      const params = new URLSearchParams({
        filterByFormula: "{Profile Status}='Accepted'",
        pageSize: "100",
        ...(offset && { offset }),
      });
      FIELDS.forEach(f => params.append("fields[]", f));

      const resp = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params}`,
        { headers: { Authorization: `Bearer ${TOKEN}` } }
      );
      if (!resp.ok) return json({ error: "Airtable error" }, 502);

      const body = await resp.json();
      for (const rec of body.records || []) {
        const f = rec.fields;
        records.push({
          id:                  rec.id,
          studentName:         clean(f["Student Name"]),
          cohort:              clean(f["Cohort of Program"]),
          graduationYear:      f["Graduation Year"] || "",
          journal:             clean(f["Journal of Acceptance (Text)"]),
          journalResubmission: clean(f["Journal of Resubmission (Text)"]),
          researchQuestion:    clean(f["PM: Research Question"]),
          mentorField:         clean(f["Research Field"]),
          country:             clean(f["Country"]),
          vertical:            clean(f["Vertical"]),
          isefStatus:          clean(f["ISEF Status"]),
          publicationLink:     clean(f["Link to Publication"]),
          isefPublicationLink: clean(f["ISEF Publication Link"]),
          journalWebsite:      clean(f["Link to Journal of Publication Website"]),
          schoolGrade:         clean(f["School Grade (Text)"]),
          programType:         clean(f["Program Type"]),
          mentorName:          clean(f["Mentor Name"]),
          mentorUniversity:    clean(f["Mentor University"]),
          mentorDegreeType:    clean(f["Mentor Highest Degree Type"]),
        });
      }
      offset = body.offset;
    } while (offset);
  } catch (err) {
    return json({ error: "Unexpected server error" }, 500);
  }

  // Cache for 5 minutes at Cloudflare's edge so a flurry of refresh clicks
  // doesn't hammer Airtable's API.
  return json(
    { updatedAt: new Date().toISOString(), students: records },
    200,
    { "Cache-Control": "s-maxage=300, stale-while-revalidate" }
  );
}
