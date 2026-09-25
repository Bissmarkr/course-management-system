import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaSearch } from "react-icons/fa";

import api from "../services/api";
import { getUser } from "../services/auth";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

// ---------- Safe Price Conversion Helper ----------
// Converts course prices (whether numeric e.g. 100 or numeric strings e.g. "100") into numbers.
// Treats zero price (0 or "0") as a valid numeric price.
// Prevents NaN by returning 0 if parsing results in an invalid number, null, or undefined.
const parsePrice = (price) => {
  if (price === null || price === undefined) return 0;
  const parsed = Number(price);
  return isNaN(parsed) ? 0 : parsed;
};

function MyEnrollments() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Sorting option state - Default is "newest" (Newest Enrolled)
  const [sortBy, setSortBy] = useState("newest");

  const user = getUser();

  // ---------- Load the logged-in student's enrollments ----------
  useEffect(() => {
    const getEnrollments = async () => {
      try {
        const response = await api.get("/enrollments/my");
        setEnrollments(response.data.enrollments);
      } catch (error) {
        setError(
          error.response?.data?.message ||
            "Failed to load your enrollments"
        );
      } finally {
        setLoading(false);
      }
    };

    getEnrollments();
  }, []);

  // Format "2026-09-21T10:15:00.000Z" into a readable date
  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString();
  };

  // ---------- Summary Statistics Calculations ----------
  // 1. Total Enrolled Courses count
  const totalCourses = enrollments.length;

  // 2. Total Enrolled Course Value (Sum of prices parsed numerically)
  const totalValue = enrollments.reduce(
    (sum, item) => sum + parsePrice(item.price),
    0
  );

  // 3. Average Course Price (Guards against division-by-zero when totalCourses is 0)
  const rawAverage = totalCourses > 0 ? totalValue / totalCourses : 0;
  const averagePrice = isNaN(rawAverage) ? 0 : rawAverage;

  // 4. Distinct Category Count (Counts unique non-empty category names)
  const distinctCategoryCount = new Set(
    enrollments
      .map((item) => item.category)
      .filter((cat) => cat !== null && cat !== undefined && cat !== "")
  ).size;

  // ---------- Non-Mutating Course Sorting ----------
  // Original Array Protection: Creates a shallow copy [...enrollments] prior to sorting
  // to prevent mutating the original enrollment array returned from the API.
  const sortedEnrollments = [...enrollments].sort((a, b) => {
    if (sortBy === "newest") {
      // Newest Enrolled: Sort by enrollment date descending
      const dateA = a.enrolled_at ? new Date(a.enrolled_at).getTime() : 0;
      const dateB = b.enrolled_at ? new Date(b.enrolled_at).getTime() : 0;
      return dateB - dateA;
    }

    if (sortBy === "oldest") {
      // Oldest Enrolled: Sort by enrollment date ascending
      const dateA = a.enrolled_at ? new Date(a.enrolled_at).getTime() : 0;
      const dateB = b.enrolled_at ? new Date(b.enrolled_at).getTime() : 0;
      return dateA - dateB;
    }

    if (sortBy === "price_high_low") {
      // Price: High to Low: Sort numerically by price descending
      return parsePrice(b.price) - parsePrice(a.price);
    }

    if (sortBy === "price_low_high") {
      // Price: Low to High: Sort numerically by price ascending
      return parsePrice(a.price) - parsePrice(b.price);
    }

    if (sortBy === "title_a_z") {
      // Course Title: A to Z: Sort alphabetically by title (case-insensitive)
      const titleA = (a.title || "").toLowerCase();
      const titleB = (b.title || "").toLowerCase();
      return titleA.localeCompare(titleB);
    }

    return 0;
  });

  return (
    <>
      <Navbar />

      <div className="container">
        <div className="page-header">
          <div>
            <h1>My Enrollments</h1>

            <p className="page-subtitle">
              {user?.full_name
                ? `${user.full_name}, these are the courses you are enrolled in.`
                : "These are the courses you are enrolled in."}
            </p>
          </div>

          <Link to="/courses" className="btn btn-primary">
            <FaSearch />
            Browse More Courses
          </Link>
        </div>

        {/* ---------- Loading ---------- */}
        {loading && (
          <p className="loading">Loading your enrollments...</p>
        )}

        {/* ---------- Error ---------- */}
        {error && !loading && (
          <p className="error">{error}</p>
        )}

        {/* ---------- Summary Header & Sorting Controls ---------- */}
        {!loading && !error && (
          <>
            {/* Enrollment Summary Cards */}
            <div className="enrollment-summary-grid">
              <div className="summary-card">
                <span className="summary-card-value">{totalCourses}</span>
                <span className="summary-card-label">Total Enrolled Courses</span>
              </div>

              <div className="summary-card">
                <span className="summary-card-value">
                  Rs. {totalValue.toLocaleString()}
                </span>
                <span className="summary-card-label">Total Course Value</span>
              </div>

              <div className="summary-card">
                <span className="summary-card-value">
                  Rs. {averagePrice % 1 === 0 ? averagePrice : averagePrice.toFixed(2)}
                </span>
                <span className="summary-card-label">Average Course Price</span>
              </div>

              <div className="summary-card">
                <span className="summary-card-value">{distinctCategoryCount}</span>
                <span className="summary-card-label">Distinct Categories</span>
              </div>
            </div>

            {/* Course Sorting Dropdown Controls */}
            <div className="sort-bar">
              <span className="result-count" style={{ margin: 0 }}>
                Showing {sortedEnrollments.length}{" "}
                {sortedEnrollments.length === 1 ? "course" : "courses"}
              </span>

              <div className="sort-group">
                <label htmlFor="sort-select" className="sort-label">
                  Sort by:
                </label>
                <select
                  id="sort-select"
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">Newest Enrolled</option>
                  <option value="oldest">Oldest Enrolled</option>
                  <option value="price_high_low">Price: High to Low</option>
                  <option value="price_low_high">Price: Low to High</option>
                  <option value="title_a_z">Course Title: A to Z</option>
                </select>
              </div>
            </div>

            {/* ---------- Empty State vs Course Grid ---------- */}
            {enrollments.length === 0 ? (
              <div className="empty-box">
                <p className="empty">
                  You are not enrolled in any courses yet.
                </p>

                <Link to="/courses" className="btn btn-primary">
                  <FaSearch />
                  Find a Course
                </Link>
              </div>
            ) : (
              <div className="course-grid">
                {sortedEnrollments.map((enrollment) => (
                  <article className="course-card" key={enrollment.id}>
                    <img
                      src={enrollment.image}
                      alt={enrollment.title}
                      className="course-card-image"
                      loading="lazy"
                    />

                    <div className="course-card-body">
                      <div className="course-card-tags">
                        <span className="tag tag-category">
                          {enrollment.category}
                        </span>

                        <span className="tag tag-level">
                          {enrollment.level}
                        </span>
                      </div>

                      <h3 className="course-card-title">
                        {enrollment.title}
                      </h3>

                      <p className="course-card-summary">
                        {enrollment.description?.slice(0, 100)}
                        {enrollment.description?.length > 100 ? "..." : ""}
                      </p>

                      <ul className="course-card-meta">
                        <li>
                          <strong>Duration:</strong> {enrollment.duration}
                        </li>

                        <li>
                          <strong>Price:</strong> Rs. {enrollment.price}
                        </li>

                        <li>
                          <strong>Enrolled on:</strong>{" "}
                          {formatDate(enrollment.enrolled_at)}
                        </li>
                      </ul>

                      <Link
                        to={`/courses/${enrollment.course_id}`}
                        className="btn btn-outline btn-block"
                      >
                        View Course
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </>
  );
}

export default MyEnrollments;
