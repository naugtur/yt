// @ts-check
const ytdl = require("@distube/ytdl-core");
const ytpl = require("ytpl");
const RSS = require("rss");
const http = require("http");
const { serveSlowa } = require("./slowa");

const sha512 = (str = "") =>
  require("crypto").createHash("sha512").update(str).digest("hex");
const ME = 'db7361599f96119edeb83e2af268434b85938686b89e6453776971e6426c28c3911055190d03f2752a37c275433ff448974192c4cc18d03c6622f79377974512';

function getVidInfo(vid) {
  return ytdl.getInfo(`https://www.youtube.com/watch?v=${vid}`).then((info) => {
    const formats = ytdl.filterFormats(info.formats, "audioonly");
    const prefered = formats.filter((f) => f.container.match(/mp4|m4a/))[0];
    return prefered || formats[0];
  });
}

function serveAudio(vid, req, res) {
  return getVidInfo(vid)
    .then((audioInfo) => {
      if (!audioInfo) {
        console.log(`no audio matches for ${vid}`);
        res.statusCode = 404;
        return res.end(`no audio matches for ${vid}`);
      }
      console.log(audioInfo);
      res.statusCode = 302;
      res.setHeader("location", audioInfo.url);
      res.end();
    })
    .catch((err) => {
      res.statusCode = 500;
      console.log(err.stack);
      res.end(err.message);
    });
}

function serveRSS(playlist, req, res) {
  const ytGet = (query) => ytpl(query, { limit: 100 });
  const flatten = (arr) => [].concat(...arr);

  const selfURL = `https://${req.headers.host}/`;

  return Promise.resolve(playlist)
    .then(ytGet)
    .catch((e) => {
      res.statusCode = 501;
      res.end(e.message);
    })
    .then((info) => {
      const items = flatten(info.items);
      let title = "No title found";
      try {
        title = info.title;
        title = `${info.title} - ${info.author.name}`;
      } catch (e) {}
      let feed = new RSS({
        title: title,
        description: "Handsfree youtube feed",
        feed_url: `${selfURL}`,
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
          enclosure: {
            url: `${selfURL}?v=${item.id}`,
            type: "audio/mp4",
            length: 60,
          },
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
}

http
  .createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      return res.end();
    }
    const u = new URL(req.url, `http://${req.headers.host}`);
    const who = req.headers.authorization;
    if (!who || sha512(who) !== ME) {
      console.error({ req, who });
      res.setHeader("WWW-Authenticate", `Basic realm="who"`);
      res.statusCode = 401;
      return res.end(`who? ${who}`);
    }

    const vid = u.searchParams.get("v");
    const playlist = u.searchParams.get("list");
    if (playlist) {
      if (playlist === "slowa") {
        return serveSlowa(req, res);
      }
      return serveRSS(playlist, req, res);
    }
    if (vid) {
      return serveAudio(vid, req, res);
    }

    res.statusCode = 200;
    res.end("hi");
  })
  .listen(8080, () => {
    console.log("server started");
  });
