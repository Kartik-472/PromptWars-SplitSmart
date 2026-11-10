
import { describe, it, expect } from "vitest";
import { calculateSettlements } from "./settlementEngine.js";

describe("SplitSmart settlement engine", () => {

    it("settles a basic three-person group", () => {
        const balances = [
            { user_id: 1, name: "A", balance: 50000 },
            { user_id: 2, name: "B", balance: -30000 },
            { user_id: 3, name: "C", balance: -20000 }
        ];

        const result = calculateSettlements(balances);

        expect(result).toHaveLength(2);

        expect(result.reduce(
            (sum, t) => sum + t.amount, 0
        )).toBe(50000);
    });

    it("returns no transactions when everyone is settled", () => {
        const balances = [
            { user_id: 1, name: "A", balance: 0 },
            { user_id: 2, name: "B", balance: 0 }
        ];

        expect(calculateSettlements(balances)).toEqual([]);
    });

    it("rejects unbalanced group data", () => {
        const balances = [
            { user_id: 1, name: "A", balance: 50000 },
            { user_id: 2, name: "B", balance: -30000 }
        ];

        expect(() => calculateSettlements(balances))
            .toThrow();
    });

    it("handles negative balances correctly", () => {
        const balances = [
            { user_id: 1, name: "A", balance: -10000 },
            { user_id: 2, name: "B", balance: 10000 }
        ];

        const result = calculateSettlements(balances);

        expect(result[0].from).toBe(1);
        expect(result[0].to).toBe(2);
        expect(result[0].amount).toBe(10000);
    });

});
