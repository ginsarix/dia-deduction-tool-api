import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { db } from "../db/index.js";
import { connectionTable } from "../db/schemas/connection.js";
import type { DiaListRequest, DiaLoginRequest } from "../types/dia-requests.js";
import type {
  DiaDepartment,
  DiaLoginResponse,
  DiaPingResponse,
  DiaResponse,
  DiaWorker,
  DiaWorkerTally,
} from "../types/dia-responses.js";
import { createDiaUrl } from "../utils/dia.js";
import { errorHasMessage } from "../utils/error.js";

type LoginResult = "login" | "successful-ping";

export class DiaClient {
  private serverCode: string;
  private sessionId?: string;
  private loginRequest: DiaLoginRequest;
  private connectionId: number;

  private constructor(
    serverCode: string,
    loginRequest: DiaLoginRequest,
    connectionId: number,
    sessionId?: string,
  ) {
    this.serverCode = serverCode;
    this.sessionId = sessionId;
    this.loginRequest = loginRequest;
    this.connectionId = connectionId;
  }

  static async create({
    serverCode,
    loginRequest,
    connectionId,
    sessionId,
  }: {
    serverCode: string;
    loginRequest: DiaLoginRequest;
    connectionId: number;
    sessionId?: string;
  }) {
    const client = new DiaClient(
      serverCode,
      loginRequest,
      connectionId,
      sessionId,
    );

    return client;
  }

  private async login(
    serverCode: string,
    loginRequest: DiaLoginRequest,
    sessionId?: string,
  ): Promise<{
    result: LoginResult;
    loginResponse?: DiaLoginResponse;
  }> {
    const requestUrl = createDiaUrl(serverCode, "sis");

    if (sessionId) {
      try {
        const pingResponse = await fetch(requestUrl, {
          method: "POST",
          body: JSON.stringify({ sis_ping: { session_id: sessionId } }),
        });

        if (!pingResponse.ok) {
          throw new HTTPException(pingResponse.status as ContentfulStatusCode, {
            message: "DIA Giriş kontrolu sırasında bir hata ile karşılaşıldı!",
          });
        }

        const pingData = (await pingResponse.json()) as DiaPingResponse;

        if (pingData.code === "200") return { result: "successful-ping" };
      } catch (error) {
        if (errorHasMessage(error)) {
          console.error("Error fetching ping:", error.message);
        }

        throw error;
      }
    }

    const loginResponse = await fetch(requestUrl, {
      method: "POST",
      body: JSON.stringify(loginRequest),
    });

    if (!loginResponse.ok) {
      throw new HTTPException(loginResponse.status as ContentfulStatusCode, {
        message: "DIA Giriş sırasında bir hata ile karşılaşıldı!",
      });
    }

    const loginData = (await loginResponse.json()) as DiaLoginResponse;

    return { result: "login", loginResponse: loginData };
  }

  private async ensureSession() {
    const { result, loginResponse } = await this.login(
      this.serverCode,
      this.loginRequest,
      this.sessionId,
    );

    if (result === "login") {
      const sessionId = loginResponse?.msg;
      this.sessionId = sessionId;
      await db
        .update(connectionTable)
        .set({ sessionId })
        .where(eq(connectionTable.id, this.connectionId));
    }
  }

  private async request<T>(
    module: string,
    body: Record<string, unknown>,
    retry = true,
  ): Promise<T> {
    await this.ensureSession();

    const [firstKeyBody] = Object.keys(body);

    const bodyWithSession = {
      [firstKeyBody]: {
        ...(body[firstKeyBody] as object),
        session_id: this.sessionId,
      },
    };

    const response = await fetch(createDiaUrl(this.serverCode, module), {
      method: "POST",
      body: JSON.stringify(bodyWithSession),
      signal: AbortSignal.timeout(15000), // timeout after 15 seconds since fetch in node doesnt have a default timeout
    });

    if (!response.ok) {
      throw new HTTPException(response.status as ContentfulStatusCode, {
        message: JSON.stringify(body),
      });
    }

    const data = await response.json();

    if (
      retry &&
      typeof data === "object" &&
      data &&
      "code" in data &&
      data.code === "401"
    ) {
      this.sessionId = undefined;
      await this.ensureSession();

      return this.request(module, body, false);
    }

    return data as T;
  }

  async getWorkers(
    request: DiaListRequest<"per_personel_listele", (keyof DiaWorker)[]>,
  ): Promise<DiaResponse<DiaWorker[]>> {
    return this.request("per", request);
  }

  // theres no essential reason to use this after the re-design of the system
  async getWorkerTallies(
    request: DiaListRequest<
      "per_personel_puantaj_listele",
      (keyof DiaWorkerTally)[]
    >,
  ): Promise<DiaResponse<DiaWorkerTally[]>> {
    return this.request("per", request);
  }

  async getDepartments(
    request: DiaListRequest<"sis_departman_listele", (keyof DiaDepartment)[]>,
  ): Promise<DiaResponse<DiaDepartment[]>> {
    return this.request("sis", request);
  }
}
