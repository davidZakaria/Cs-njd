export function twoFactorResetReviewPath(userId: string): string {
  return `/users/2fa-reset/${userId}`;
}

export function isTwoFactorResetReviewLink(link: string | null | undefined): boolean {
  if (!link) return false;
  return link.includes("/users/2fa-reset/");
}
