import { JsonMap } from "./JsonMap";

export class JsonMapComparator {
    private listOfErrors: string[] = [];

    compare(firstMap: JsonMap, secondMap: JsonMap): number {
        let compare = 0;
        if (firstMap.size() !== secondMap.size()) {
            this.logAndAddToList(`Size mismatch: FirstMap (${firstMap.size()}), SecondMap (${secondMap.size()})`);
            compare = firstMap.size() > secondMap.size() ? 1 : -1;
        }

        const unionSet = new Set([...firstMap.keySet(), ...secondMap.keySet()]);
        this.compareKeySets(unionSet, firstMap.keySet(), "First");
        this.compareKeySets(unionSet, secondMap.keySet(), "Second");

        const intersect = new Set([...firstMap.keySet()].filter(key => secondMap.keySet().has(key)));
        intersect.forEach(key => this.compareValues(firstMap, secondMap, key));

        return this.listOfErrors.length > 1 ? 1 : compare;
    }

    private compareValues(firstMap: JsonMap, secondMap: JsonMap, key: string): void {
        const firstValue = firstMap.get(key);
        const secondValue = secondMap.get(key);

        const firstType = typeof firstValue;
        const secondType = typeof secondValue;

        if (firstType !== secondType) {
            this.logAndAddToList(`Type mismatch for key '${key}': FirstMap (${firstType}), SecondMap (${secondType})`);
        } else if (firstValue !== secondValue) {
            this.logAndAddToList(`Data mismatch for key '${key}': FirstMap (${firstValue}), SecondMap (${secondValue})`);
        }
    }

    private compareKeySets(firstSet: Set<string>, secondSet: Set<string>, name: string): void {
        const missingKeys = [...firstSet].filter(key => !secondSet.has(key));
        if (missingKeys.length > 0) {
            this.logAndAddToList(`Missing keys in ${name} map: ${missingKeys.join(", ")}`);
        }
    }

    private logAndAddToList(message: string): void {
        console.debug(message);
        this.listOfErrors.push(message);
    }

    getListOfErrors(): string[] {
        return this.listOfErrors;
    }
}