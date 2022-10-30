import debug from "debug";

const name = "neume-network-extraction-worker";
const log = (subname) => debug(`${name}:${subname}`);
export default log;
