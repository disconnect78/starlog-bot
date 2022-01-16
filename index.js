'use strict'

const Got = require('got')
const HtmlParser = require('node-html-parser')
const { TwitterApi } = require('twitter-api-v2')

const config = require('./config')

;(async () => {
  const item = await getRandomItem()
  const metadata = await getMetadata(item)
  const page = await getRandomPage(item, metadata)
  const image = await getImage(imageUrl(item, page))

  await doTweet(image, item, metadata, page)
})()

// Get the items in the collection and return a random one
async function getRandomItem () {
  const items = await getCollectionItems(config.collection)
  const randomItem = randomElement(items)
  return randomItem
}

async function getMetadata (item) {
  return await Got.get(`https://archive.org/metadata/${item}`).json()
}

// Get the number of pages in the item and return a random page number
async function getRandomPage (item, metadata) {
  const numberOfPages = await getNumberOfPages(item, metadata)
  return Math.floor(Math.random() * numberOfPages)
}

async function doTweet (image, item, metadata, page) {
  try {
    const client = new TwitterApi(config.credentials)
    const mediaId = await client.v1.uploadMedia(Buffer.from(image), { type: 'jpg' })

    await client.v2.tweet(
      tweetText(item, metadata, page),
      { media: { media_ids: [mediaId] } }
    )
  } catch (error) {
    console.log(error)
  }
}

// Return array of items in a given collection
async function getCollectionItems (collectionName) {
  const { response } = await Got.get('https://archive.org/advancedsearch.php', {
    searchParams: searchParams(collectionName)
  }).json()
  return response.docs.map(item => item.identifier)
}

// Return number of pages in a given item
async function getNumberOfPages (item, metadata) {
  const response = await Got.get(`https://archive.org/download/${item}/${scandataFilename(metadata)}`)
  // Parse the XML response
  const parsedResponse = HtmlParser.parse(response.body)
  return parsedResponse.querySelector('leafCount').text
}

// Return filename of an item's scandata.xml
function scandataFilename (metadata) {
  return metadata.files.filter(file => file.format === 'Scandata')[0].name
}

async function getImage (imageUrl) {
  return Got.get(imageUrl).buffer()
}

function searchParams (collectionName) {
  return { q: `collection:${collectionName}`, fl: 'identifier', output: 'json', rows: 1000 }
}

function randomElement (array) {
  return array[Math.floor(Math.random() * array.length)]
}

function imageUrl (item, page) {
  return `https://archive.org/download/${item}/page/n${page}.jpg`
}

function pageUrl (item, page) {
  return `https://archive.org/details/${item}/page/n${page}/mode/2up`
}

// Get item name from metadata and append page number. We add 1 to the page
// number from the filename to give us the actual magazine page number
function issueString ({ metadata }, page) {
  return `${metadata.title}, page ${page + 1}`
}

function tweetText (item, metadata, page) {
  const url = pageUrl(item, page)
  const issue = issueString(metadata, page)
  return `${issue}

Full magazine: ${url}`
}
