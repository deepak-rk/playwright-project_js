export class JsonMap {
    private map: Map<string, any>;
    private primaryKey: string;

    constructor(json: string, primaryKey: string = "id") {
        this.map = new Map();
        this.primaryKey = primaryKey;
        const jsonObject = JSON.parse(json);
        this.createMap("", jsonObject);
        this.sortMap();
    }

    private createMap(path: string, jsonNode: any): void {
        if (typeof jsonNode === "object" && !Array.isArray(jsonNode) && jsonNode !== null) {
            for (const [key, value] of Object.entries(jsonNode)) {
                const childPath = path ? `${path}.${key}` : key;
                this.createMap(childPath, value);
            }
        } else if (Array.isArray(jsonNode)) {
            jsonNode.forEach((value, index) => {
                this.createMap(`${path}[${index}]`, value);
            });
        } else {
            this.map.set(path, jsonNode);
        }
    }

    private sortMap(): void {
        this.map = new Map([...this.map.entries()].sort(([keyA], [keyB]) => keyA.localeCompare(keyB)));
    }

    size(): number {
        return this.map.size;
    }

    keySet(): Set<string> {
        return new Set(this.map.keys());
    }

    get(key: string): any {
        return this.map.get(key);
    }
}