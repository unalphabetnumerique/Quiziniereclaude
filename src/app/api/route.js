export async function GET() {
  return new Response(JSON.stringify({ message: "API OK 🔥" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}