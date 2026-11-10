
export function calculateSettlements(balances) {
    const creditors = [];
    const debtors = [];

    for (const person of balances) {
        if (!Number.isSafeInteger(person.balance)) {
            throw new Error("Balances must be integer minor units");
        }

        if (person.balance > 0) {
            creditors.push({
                id: person.user_id,
                name: person.name,
                amount: person.balance
            });
        } else if (person.balance < 0) {
            debtors.push({
                id: person.user_id,
                name: person.name,
                amount: -person.balance
            });
        }
    }

    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const transactions = [];

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
        const amount = Math.min(
            debtors[i].amount,
            creditors[j].amount
        );

        transactions.push({
            from: debtors[i].id,
            fromName: debtors[i].name,
            to: creditors[j].id,
            toName: creditors[j].name,
            amount
        });

        debtors[i].amount -= amount;
        creditors[j].amount -= amount;

        if (debtors[i].amount === 0) i++;
        if (creditors[j].amount === 0) j++;
    }

    const unmatched = [...debtors.slice(i), ...creditors.slice(j)]
        .some(p => p.amount !== 0);

    if (unmatched) {
        throw new Error("Group balances do not sum to zero");
    }

    return transactions;
}
