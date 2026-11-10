export const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK === "1"

if (MOCK_MODE && typeof window !== "undefined") {
  require("./runtime").installMocks()
}
