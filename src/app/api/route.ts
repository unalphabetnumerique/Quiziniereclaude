import { NextRequest, NextResponse } from "next/server";
import type {
  ExerciseApiResponse,
  ExercisePayload,
  ExerciseQuestion,
  ExerciseType
} from "@/types/exercise";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama3-8b-8192";

function buildPrompt(payload: ExercisePayload): string {
  return `Tu es un professeur. Reponds UNIQUEMENT par un objet JSON valide, sans balises markdown, sans texte avant ou apres le JSON.

Structure:
{
  "titre": "string",
  "instructions": "string",
  "questions": [ ... ]
}

Contraintes:
- Exactement ${payload.nombreQuestions} questions.
- Matiere: ${payload.matiere}
- Niveau: ${payload.niveau}
- Chaque question a "id" (nombre entier sequentiel), "enonce" (string), "type": "${payload.typeExercice}".

Si type "qcm": ajoute "options" (tableau de 4 strings) et "reponse" (string, egale a une des options).
Si type "vrai-faux": pas de "options", "reponse" est un booleen true ou false.
Si type "texte-a-trous": pas de "options", "reponse" est une string (reponse attendue).

Tu peux ajouter "explication" (string) sur chaque question.`;
}

function stripJsonFromCompletion(text: string): string {
  let t = text.trim();
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```/im.exec(t);
  if (fenced) {
    t = fenced[1].trim();
  }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return t.slice(start, end + 1);
  }
  return t;
}

function isExerciseType(value: unknown): value is ExerciseType {
  return (
    value === "qcm" || value === "vrai-faux" || value === "texte-a-trous"
  );
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

function parseExerciseResponse(
  raw: string,
  expectedType: ExerciseType,
  expectedCount: number
): ExerciseApiResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFromCompletion(raw));
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as ExerciseApiResponse).titre !== "string" ||
    typeof (parsed as ExerciseApiResponse).instructions !== "string" ||
    !Array.isArray((parsed as ExerciseApiResponse).questions)
  ) {
    return null;
  }

  const { titre, instructions, questions: rawQuestions } =
    parsed as ExerciseApiResponse;

  if (rawQuestions.length !== expectedCount) {
    return null;
  }

  const questions: ExerciseQuestion[] = [];

  for (const item of rawQuestions) {
    if (typeof item !== "object" || item === null) {
      return null;
    }
    const q = item as Record<string, unknown>;
    if (
      typeof q.id !== "number" ||
      typeof q.enonce !== "string" ||
      !isExerciseType(q.type) ||
      q.type !== expectedType
    ) {
      return null;
    }

    if (expectedType === "qcm") {
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return null;
      }
      const options = q.options.filter((o) => typeof o === "string") as string[];
      if (options.length !== q.options.length || typeof q.reponse !== "string") {
        return null;
      }
      questions.push({
        id: q.id,
        enonce: q.enonce,
        type: "qcm",
        options,
        reponse: q.reponse,
        explication:
          typeof q.explication === "string" ? q.explication : undefined
      });
      continue;
    }

    if (expectedType === "vrai-faux") {
      const reponse = normalizeBoolean(q.reponse);
      if (reponse === null) {
        return null;
      }
      questions.push({
        id: q.id,
        enonce: q.enonce,
        type: "vrai-faux",
        reponse,
        explication:
          typeof q.explication === "string" ? q.explication : undefined
      });
      continue;
    }

    if (typeof q.reponse !== "string") {
      return null;
    }
    questions.push({
      id: q.id,
      enonce: q.enonce,
      type: "texte-a-trous",
      reponse: q.reponse,
      explication:
        typeof q.explication === "string" ? q.explication : undefined
    });
  }

  return { titre, instructions, questions };
}

function extractChatCompletionContent(data: unknown): string | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const choices = (data as { choices?: unknown[] }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0] as { message?: { content?: unknown } };
  const content = first.message?.content;
  return typeof content === "string" ? content : null;
}

function groqErrorMessage(data: unknown): string | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string") {
    return err;
  }
  if (typeof err === "object" && err !== null && "message" in err) {
    const msg = (err as { message: unknown }).message;
    return typeof msg === "string" ? msg : null;
  }
  return null;
}

export async function GET() {
  return new Response(JSON.stringify({ message: "API OK 🔥" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Variable GROQ_API_KEY manquante." },
      { status: 500 }
    );
  }

  let payload: ExercisePayload;
  try {
    payload = (await request.json()) as ExercisePayload;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (
    typeof payload.matiere !== "string" ||
    typeof payload.niveau !== "string" ||
    typeof payload.nombreQuestions !== "number" ||
    !isExerciseType(payload.typeExercice)
  ) {
    return NextResponse.json({ error: "Parametres invalides." }, { status: 400 });
  }

  const userPrompt = buildPrompt(payload);

  let groqResponse: Response;
  try {
    groqResponse = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Tu es un professeur. Tu reponds exclusivement par un objet JSON brut, sans balises markdown, sans texte avant ou apres."
          },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.6,
        max_tokens: 4096
      })
    });
  } catch {
    return NextResponse.json(
      { error: "Impossible de joindre Groq." },
      { status: 502 }
    );
  }

  const groqJson: unknown = await groqResponse.json().catch(() => null);

  if (!groqResponse.ok) {
    const errMsg =
      groqErrorMessage(groqJson) ?? `Groq HTTP ${groqResponse.status}`;
    return NextResponse.json({ error: errMsg }, { status: 502 });
  }

  const generated = extractChatCompletionContent(groqJson);
  if (!generated) {
    return NextResponse.json(
      { error: "Reponse du modele illisible." },
      { status: 502 }
    );
  }

  const exercises = parseExerciseResponse(
    generated,
    payload.typeExercice,
    payload.nombreQuestions
  );

  if (!exercises) {
    return NextResponse.json(
      {
        error:
          "Le modele n'a pas renvoye un JSON valide. Reessaie ou reduis le nombre de questions."
      },
      { status: 502 }
    );
  }

  return NextResponse.json(exercises);
}
