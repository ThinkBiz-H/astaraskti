/**
 * Reusable helper for building Mongoose queries with
 * search, filter, sort, field-limiting and pagination.
 */
class ApiFeatures {
  constructor(query, queryString) {
    this.query = query; // Mongoose query
    this.queryString = queryString; // req.query
  }

  search(fields = ["title"]) {
    if (this.queryString.keyword) {
      const keyword = this.queryString.keyword;
      const orConditions = fields.map((field) => ({
        [field]: { $regex: keyword, $options: "i" },
      }));
      this.query = this.query.find({ $or: orConditions });
    }
    return this;
  }

  filter() {
    const queryObj = { ...this.queryString };

    const excludedFields = ["keyword", "page", "sort", "limit", "fields"];
    excludedFields.forEach((field) => delete queryObj[field]);

    // Remove empty query params
    Object.keys(queryObj).forEach((key) => {
      if (
        queryObj[key] === "" ||
        queryObj[key] === undefined ||
        queryObj[key] === null
      ) {
        delete queryObj[key];
      }
    });

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    const parsedQuery = JSON.parse(queryStr);

    this.query = this.query.find(parsedQuery);
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort("-createdAt");
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select("-__v");
    }
    return this;
  }

  paginate() {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 12;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    this.pagination = { page, limit };
    return this;
  }
}

module.exports = ApiFeatures;
