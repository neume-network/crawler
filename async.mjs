const map = async function (list, mapper, options) {
  let results = await Promise.all(list.map(mapper));

  if (options.filter) {
    results = results.filter(options.filter);
  }

  return results;
};

export default { map };
