export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json({ error: "shadow_mode_persistence_unavailable", eventId: id, message: "ยังไม่บันทึกการรับทราบที่ server จนกว่าจะมี D1 และ actor authorization" }, { status: 503, headers: { "Cache-Control": "no-store", "X-Surveillance-Mode": "shadow-synthetic" } });
}
