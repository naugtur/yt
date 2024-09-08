// @ts-check
const ytpl = require("ytpl");
const RSS = require("rss");
const http = require("http");

const sources = [
  {
    sourceId: "https://www.youtube.com/channel/UCLlzlc4XSItHVTcMnrIlv1w",
    regex: /ewangeliarzop|dominikanie na niedziel/gi,
    limit: 10,
  },
  {
    sourceId: "https://www.youtube.com/user/Maskacjusz",
    regex: /Ewangelia/gi,
    limit: 10,
  },
  {
    sourceId: "https://www.youtube.com/channel/UCme4ZOv65uzGADXuvtHkSvA",
    regex: /CNN|Rekolekcje|wstawaki|medytacje/gi,
    limit: 10,
  },
];

function ytGet({ sourceId, regex, limit }) {
  return ytpl(sourceId, { limit: limit }).then((info) => {
    if (regex) {
      return info.items.filter((item) => item.title.match(regex));
    }
    return info.items;
  });
}

const zip = (sources) => {
  let result = [];
  let slice;

  do {
    slice = sources.map((source) => source.shift()).filter((i) => i);
    result = result.concat(slice);
  } while (slice.length);

  return result;
};

exports.serveSlowa = function serveSlowa(req, res) {
  const selfURL = `https://${req.headers.host}/`;

  return Promise.all(sources.map(ytGet))
    .then((results) => {
      const items = zip(results);
      let feed = new RSS({
        title: "Czytanie z komentarzem",
        description:
          "Czytanie z MaskacjuszTV, komentarze z Dominikanie.pl i Wstawaki",
        feed_url: `${selfURL}/feed`,
        ttl: "60",
        custom_namespaces: {
          itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
        },
        custom_elements: [
          //TODO add more podcast specific info
        ],
      });

      items.forEach((item) => {
        feed.item({
          title: item.title,
          enclosure: { url: `${selfURL}?v=${item.id}`, type: "audio/mp4" },
          url: `${selfURL}?v=${item.id}`,
          custom_elements: [
            {
              "itunes:image": {
                _attr: {
                  href: item.thumbnail,
                },
              },
            },
          ],
        });
      });

      return feed.xml();
    })
    .then((feedXML) => {
      res.setHeader("content-type", "application/rss+xml");
      res.setHeader("cache-control", "s-maxage=60");
      res.end(feedXML);
    });
};
