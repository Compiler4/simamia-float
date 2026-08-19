type ApiResult = {
  success: boolean;

  message?: string;

  [key: string]:
    unknown;
};

async function readApiResponse(
  response: Response,
): Promise<any> {
  const contentType =
    response.headers
      .get(
        "content-type",
      )
      ?.toLowerCase() ??
    "";

  let data:
    any = null;

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    try {
      data =
        await response.json();
    } catch {
      data = null;
    }
  } else {
    const raw =
      await response.text();

    data = {
      success:
        false,

      message:
        raw ||
        "The server returned an invalid response.",
    };
  }

  if (
    !response.ok
  ) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed (${response.status}).`,
    );
  }

  return data;
}

/* ============================================================
   DOCUMENT AUTO-FILL
============================================================ */

export async function autofillBrokerDocument(
  file: File,
): Promise<ApiResult> {
  if (!file) {
    throw new Error(
      "Choose a broker registration document.",
    );
  }

  if (
    file.size <= 0
  ) {
    throw new Error(
      "The selected document is empty.",
    );
  }

  if (
    file.size >
    10 * 1024 * 1024
  ) {
    throw new Error(
      "The document cannot exceed 10 MB.",
    );
  }

  /*
   * IMPORTANT.
   *
   * Use FormData.
   */
  const formData =
    new FormData();

  formData.append(
    "file",
    file,
    file.name,
  );

  const response =
    await fetch(
      "/api/company-admin/brokers/autofill",
      {
        method:
          "POST",

        credentials:
          "include",

        /*
         * DO NOT WRITE:
         *
         * headers: {
         *   "Content-Type": "application/json"
         * }
         *
         * DO NOT WRITE:
         *
         * headers: {
         *   "Content-Type": "multipart/form-data"
         * }
         *
         * Browser creates the correct Content-Type
         * together with its multipart boundary.
         */

        body:
          formData,

        cache:
          "no-store",
      },
    );

  return readApiResponse(
    response,
  );
}

/* ============================================================
   UPDATE BROKER
============================================================ */

export async function updateBroker(
  brokerId: string,
  input: Record<
    string,
    unknown
  >,
): Promise<ApiResult> {
  if (!brokerId) {
    throw new Error(
      "Broker ID is required.",
    );
  }

  const response =
    await fetch(
      `/api/company-admin/brokers/${encodeURIComponent(
        brokerId,
      )}`,
      {
        method:
          "PATCH",

        credentials:
          "include",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(
            input,
          ),

        cache:
          "no-store",
      },
    );

  return readApiResponse(
    response,
  );
}

/* ============================================================
   SUSPEND BROKER
============================================================ */

export async function suspendBroker(
  brokerId: string,
): Promise<ApiResult> {
  if (!brokerId) {
    throw new Error(
      "Broker ID is required.",
    );
  }

  const response =
    await fetch(
      `/api/company-admin/brokers/${encodeURIComponent(
        brokerId,
      )}`,
      {
        method:
          "DELETE",

        credentials:
          "include",

        headers: {
          Accept:
            "application/json",
        },

        cache:
          "no-store",
      },
    );

  return readApiResponse(
    response,
  );
}