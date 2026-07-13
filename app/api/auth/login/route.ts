import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, createSessionValue, getDashboardPath } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const login = String(body.login || "").trim();
    const password = String(body.password || "");

    if (!login || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "Username/email and password are required.",
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          {
            username: login,
          },
          {
            email: login,
          },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        companyId: true,
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid username/email or password.",
        },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          message: "Your account is suspended. Contact administrator.",
        },
        { status: 403 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          success: false,
          message: "This account has no password. Run database seed again.",
        },
        { status: 500 }
      );
    }

    const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordIsValid) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid username/email or password.",
        },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const sessionUser = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
    };

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      redirectTo: getDashboardPath(user.role),
      user: sessionUser,
    });

    response.cookies.set({
      name: AUTH_COOKIE,
      value: createSessionValue(sessionUser),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    console.error("LOGIN_ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Login failed. Check database connection and Prisma setup.",
      },
      { status: 500 }
    );
  }
}