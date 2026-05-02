import { ExerciseApiResponse, ExercisePayload } from "@/types/exercise";

function buildQuestionText(
  payload: ExercisePayload,
  index: number,
  total: number
): string {
  return `Question ${index + 1}/${total} - ${payload.matiere} (${payload.niveau})`;
}

export function generateFallbackExercises(
  payload: ExercisePayload
): ExerciseApiResponse {
  const questions = Array.from({ length: payload.nombreQuestions }, (_, index) => {
    if (payload.typeExercice === "qcm") {
      return {
        id: index + 1,
        enonce: `${buildQuestionText(payload, index, payload.nombreQuestions)} : Choisis la bonne reponse.`,
        type: "qcm" as const,
        options: ["Option A", "Option B", "Option C", "Option D"],
        reponse: "Option B",
        explication: "Exemple de correction generee localement."
      };
    }

    if (payload.typeExercice === "vrai-faux") {
      return {
        id: index + 1,
        enonce: `${buildQuestionText(payload, index, payload.nombreQuestions)} : Cette affirmation est-elle vraie ?`,
        type: "vrai-faux" as const,
        reponse: index % 2 === 0,
        explication: "Exemple de justification vrai/faux."
      };
    }

    return {
      id: index + 1,
      enonce: `${buildQuestionText(payload, index, payload.nombreQuestions)} : Complete le texte a trous.`,
      type: "texte-a-trous" as const,
      reponse: "mot attendu",
      explication: "Indice : base sur le chapitre en cours."
    };
  });

  return {
    titre: `Serie ${payload.typeExercice} - ${payload.matiere}`,
    instructions: `Reponds a ${payload.nombreQuestions} questions pour le niveau ${payload.niveau}.`,
    questions
  };
}
