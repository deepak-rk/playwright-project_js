const { JsonMap } = require("./tests/JsonMap");
const { JsonMapComparator } = require("./tests/JsonMapComparator");

function compareMaps(firstJsonMap, secondJsonMap) {
    const jsonMapComparator = new JsonMapComparator();
    jsonMapComparator.compare(firstJsonMap, secondJsonMap);
    return jsonMapComparator.getListOfErrors();
}

// Sample usage
const map1 = new JsonMap(JSON.stringify({ id: 1, name: "Alice", age: 25 }));
const map2 = new JsonMap(JSON.stringify({ id: 1, name: "Alice", age: "25" }));

const errors = compareMaps(map1, map2);
console.log("Comparison Errors:", errors);