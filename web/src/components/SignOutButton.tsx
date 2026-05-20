import { useAuthActions } from "@convex-dev/auth/react";

/** Header button that signs the user out via Convex Auth. */
export function SignOutButton() {
  const { signOut } = useAuthActions();
  return (
    <button className="ghost small" onClick={() => signOut()}>
      Sign out
    </button>
  );
}
