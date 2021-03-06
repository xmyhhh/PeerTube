/* tslint:disable:no-unused-expression */

import * as request from 'supertest'
import { VideosSearchQuery } from '../../models/search'
import { immutableAssign } from '../miscs/miscs'

function searchVideo (url: string, search: string) {
  const path = '/api/v1/search/videos'

  const query = { sort: '-publishedAt', search: search }
  const req = request(url)
    .get(path)
    .query(query)
    .set('Accept', 'application/json')

  return req.expect(200)
            .expect('Content-Type', /json/)
}

function searchVideoWithToken (url: string, search: string, token: string, query: { nsfw?: boolean } = {}) {
  const path = '/api/v1/search/videos'
  const req = request(url)
    .get(path)
    .set('Authorization', 'Bearer ' + token)
    .query(immutableAssign(query, { sort: '-publishedAt', search }))
    .set('Accept', 'application/json')

  return req.expect(200)
            .expect('Content-Type', /json/)
}

function searchVideoWithPagination (url: string, search: string, start: number, count: number, sort?: string) {
  const path = '/api/v1/search/videos'

  const query = {
    start,
    search,
    count
  }

  const req = request(url)
    .get(path)
    .query(query)

  if (sort) req.query({ sort })

  return req.set('Accept', 'application/json')
            .expect(200)
            .expect('Content-Type', /json/)
}

function searchVideoWithSort (url: string, search: string, sort: string) {
  const path = '/api/v1/search/videos'

  const query = { search, sort }

  return request(url)
    .get(path)
    .query(query)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

function advancedVideosSearch (url: string, options: VideosSearchQuery) {
  const path = '/api/v1/search/videos'

  return request(url)
    .get(path)
    .query(options)
    .set('Accept', 'application/json')
    .expect(200)
    .expect('Content-Type', /json/)
}

// ---------------------------------------------------------------------------

export {
  searchVideo,
  advancedVideosSearch,
  searchVideoWithToken,
  searchVideoWithPagination,
  searchVideoWithSort
}
