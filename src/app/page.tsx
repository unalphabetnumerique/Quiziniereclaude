"use client";

import { FormEvent, useMemo, useState } from "react";
import { AuthBar } from "@/components/auth-bar";
import {
  ExerciseApiResponse,
  ExercisePayload,
  ExerciseQuestion,
  ExerciseType
} from "@/types/exercise";

const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  qcm: "QCM",
  "vrai-faux": "Vrai / Faux",
  "texte-a-trous": "Texte a trous"
};

const initialForm: ExercisePayload = {
  matiere: "",
  niveau: "",
  typeExercice: "qcm",
  nombreQuestions: 5
};

type UserAnswer = {
  value: string | boolean;
  isCorrect: boolean;
};

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}.\-+/= ]/gu, "");
}

function extractLeadingNumber(value: string): number | null {
  const normalized = normalizeText(value);
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function looksLikeSameNumericAnswer(a: string, b: string): boolean {
  const numberA = extractLeadingNumber(a);
  const numberB = extractLeadingNumber(b);
  if (numberA === null || numberB === null) {
    return false;
  }
  return Math.abs(numberA - numberB) < 1e-6;
}

function isEquivalentAnswer(expected: string, given: string): boolean {
  const normalizedExpected = normalizeText(expected);
  const normalizedGiven = normalizeText(given);

  if (normalizedExpected === normalizedGiven) {
    return true;
  }

  if (
    normalizedExpected.includes(normalizedGiven) ||
    normalizedGiven.includes(normalizedExpected)
  ) {
    return true;
  }

  return looksLikeSameNumericAnswer(normalizedExpected, normalizedGiven);
}

function resolveExpectedForQcm(question: ExerciseQuestion): string {
  const expected = String(question.reponse);
  if (!question.options?.length) {
    return expected;
  }

  const normalizedExpected = normalizeText(expected);
  const direct = question.options.find(
    (option) => normalizeText(option) === normalizedExpected
  );
  if (direct) {
    return direct;
  }

  const letterMap: Record<string, number> = {
    a: 0,
    b: 1,
    c: 2,
    d: 3
  };
  const letterMatch = normalizedExpected.match(
    /^(?:option\s*)?([abcd])(?:\)|\.|$)/
  );
  if (letterMatch) {
    const index = letterMap[letterMatch[1]];
    if (question.options[index]) {
      return question.options[index];
    }
  }

  const containsMatch = question.options.find((option) =>
    isEquivalentAnswer(option, expected)
  );
  return containsMatch ?? expected;
}

function answerLabel(question: ExerciseQuestion): string {
  if (typeof question.reponse === "boolean") {
    return question.reponse ? "Vrai" : "Faux";
  }
  return question.reponse;
}

export default function HomePage() {
  const [formData, setFormData] = useState<ExercisePayload>(initialForm);
  const [result, setResult] = useState<ExerciseApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, UserAnswer>>({});
  const [textInputs, setTextInputs] = useState<Record<number, string>>({});

  const jsonPreview = useMemo(
    () => (result ? JSON.stringify(result, null, 2) : ""),
    [result]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Erreur de generation.");
      }

      const data = (await response.json()) as ExerciseApiResponse;
      setAnswers({});
      setTextInputs({});
      setResult(data);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Une erreur inconnue est survenue.";
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function submitChoice(
    questionIndex: number,
    question: ExerciseQuestion,
    value: string | boolean
  ) {
    let isCorrect = false;

    if (typeof question.reponse === "boolean" && typeof value === "boolean") {
      isCorrect = value === question.reponse;
    } else {
      const expectedString =
        question.type === "qcm"
          ? resolveExpectedForQcm(question)
          : String(question.reponse);
      const givenString = String(value);
      isCorrect = isEquivalentAnswer(expectedString, givenString);
    }

    setAnswers((previous) => ({
      ...previous,
      [questionIndex]: {
        value,
        isCorrect
      }
    }));
  }

  function submitTextAnswer(questionIndex: number, question: ExerciseQuestion) {
    const typed = textInputs[questionIndex] ?? "";
    if (!typed.trim()) {
      return;
    }
    submitChoice(questionIndex, question, typed);
  }

  function onExport() {
    if (!result) {
      return;
    }
    const blob = new Blob([jsonPreview], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "exercices-quiziniere-ia.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Quiziniere IA</h1>
            <p className="mt-2 text-sm text-blue-100">
              Genere des exercices pedagogiques automatiquement puis joue-les en
              mode quiz interactif.
            </p>
          </div>
          <AuthBar />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Matiere</span>
            <input
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="Ex: Mathematiques"
              value={formData.matiere}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  matiere: event.target.value
                }))
              }
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Niveau</span>
            <input
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              placeholder="Ex: 4eme"
              value={formData.niveau}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  niveau: event.target.value
                }))
              }
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Type d'exercice
            </span>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              value={formData.typeExercice}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  typeExercice: event.target.value as ExerciseType
                }))
              }
            >
              <option value="qcm">QCM</option>
              <option value="vrai-faux">Vrai / Faux</option>
              <option value="texte-a-trous">Texte a trous</option>
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Nombre de questions
            </span>
            <input
              required
              min={1}
              max={20}
              type="number"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              value={formData.nombreQuestions}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  nombreQuestions: Number(event.target.value)
                }))
              }
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="sm:col-span-2 rounded-xl bg-blue-600 px-4 py-3 font-medium text-white transition duration-200 hover:scale-[1.01] hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {loading ? "Generation en cours..." : "Generer les exercices"}
          </button>
        </form>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      {result ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {result.titre}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{result.instructions}</p>
            </div>
            <button
              type="button"
              onClick={onExport}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Exporter en JSON
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            {result.questions.map((question, questionIndex) => (
              <article
                key={`${question.id}-${questionIndex}`}
                className="rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                  {EXERCISE_TYPE_LABELS[question.type]}
                </p>
                <p className="mt-1 font-medium text-slate-900">{question.enonce}</p>

                {question.type === "qcm" && question.options?.length ? (
                  <div className="mt-4 grid gap-2">
                    {question.options.map((option, optionIndex) => {
                      const selected = answers[questionIndex]?.value === option;
                      return (
                        <button
                          key={`${questionIndex}-${optionIndex}-${option}`}
                          type="button"
                          onClick={() =>
                            submitChoice(questionIndex, question, option)
                          }
                          className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                            selected
                              ? "border-blue-500 bg-blue-50 text-blue-800"
                              : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {question.type === "vrai-faux" ? (
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => submitChoice(questionIndex, question, true)}
                      className={`rounded-xl border px-4 py-2 text-sm transition ${
                        answers[questionIndex]?.value === true
                          ? "border-blue-500 bg-blue-50 text-blue-800"
                          : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"
                      }`}
                    >
                      Vrai
                    </button>
                    <button
                      type="button"
                      onClick={() => submitChoice(questionIndex, question, false)}
                      className={`rounded-xl border px-4 py-2 text-sm transition ${
                        answers[questionIndex]?.value === false
                          ? "border-blue-500 bg-blue-50 text-blue-800"
                          : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"
                      }`}
                    >
                      Faux
                    </button>
                  </div>
                ) : null}

                {question.type === "texte-a-trous" ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                      placeholder="Tape ta reponse..."
                      value={textInputs[questionIndex] ?? ""}
                      onChange={(event) =>
                        setTextInputs((previous) => ({
                          ...previous,
                          [questionIndex]: event.target.value
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => submitTextAnswer(questionIndex, question)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                    >
                      Valider
                    </button>
                  </div>
                ) : null}

                {answers[questionIndex] ? (
                  <div
                    className={`mt-4 rounded-xl border p-3 text-sm transition-all duration-300 ${
                      answers[questionIndex].isCorrect
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-red-200 bg-red-50 text-red-800"
                    }`}
                  >
                    <p className="font-semibold">
                      {answers[questionIndex].isCorrect
                        ? "Bonne reponse."
                        : "Mauvaise reponse."}
                    </p>
                    <p className="mt-1">
                      Reponse attendue :{" "}
                      <span className="font-semibold">{answerLabel(question)}</span>
                    </p>
                    {question.explication ? (
                      <p className="mt-1">Explication : {question.explication}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    Choisis une reponse pour voir la correction.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
