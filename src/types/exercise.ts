export type ExerciseType = "qcm" | "vrai-faux" | "texte-a-trous";

export type ExerciseQuestion = {
  id: number;
  enonce: string;
  type: ExerciseType;
  options?: string[];
  reponse: string | boolean;
  explication?: string;
};

export type ExercisePayload = {
  matiere: string;
  niveau: string;
  typeExercice: ExerciseType;
  nombreQuestions: number;
};

export type ExerciseApiResponse = {
  titre: string;
  instructions: string;
  questions: ExerciseQuestion[];
};
