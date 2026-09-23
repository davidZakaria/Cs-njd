export function twoFactorResetRequestsPath(): string {
  return "/users/2fa-requests";
}

export function twoFactorResetReviewPath(userId: string): string {
  return `/users/2fa-reset/${userId}`;
}

export function isTwoFactorResetReviewLink(link: string | null | undefined): boolean {
  if (!link) return false;
  return (
    link.includes("/users/2fa-reset/") || link.includes("/users/2fa-requests")
  );
}
