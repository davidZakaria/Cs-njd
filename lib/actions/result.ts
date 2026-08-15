export type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

export function actionOk(message?: string): ActionResult {
  return { success: true, message };
}

export function actionFail(error: string): ActionResult {
  return { success: false, error };
}
