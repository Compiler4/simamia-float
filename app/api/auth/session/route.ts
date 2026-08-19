import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
  getDashboardPath,
  getRoleLabel,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic =
  "force-dynamic";

export const revalidate = 0;

export async function GET(): Promise<Response> {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: true,
          authenticated: false,
          user: null,
          redirectTo: "/login",
        },
        {
          status: 200,
        },
      );
    }

    return NextResponse.json(
      {
        success: true,
        authenticated: true,

        user: {
          ...user,

          roleLabel:
            getRoleLabel(
              user.role,
            ),
        },

        redirectTo:
          getDashboardPath(
            user.role,
          ),
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "AUTH_SESSION_ERROR:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        authenticated: false,
        user: null,

        message:
          "The authentication session could not be checked.",
      },
      {
        status: 500,
      },
    );
  }
}