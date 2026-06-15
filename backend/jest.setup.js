import { jest } from "@jest/globals";

// Quiet noisy logs during tests. Individual test files mock ../DB/connect.js
// themselves, so no global DB mock is needed here.
jest.spyOn(console, "log").mockImplementation(() => {});
