import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaEdit,
  FaEye,
  FaPlus,
  FaSave,
  FaTimes,
  FaTrash,
} from "react-icons/fa";

import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const EMPTY_COURSE = {
  title: "",
  category: "",
  level: "Beginner",
  duration: "",
  price: "",
  image: "",
  description: "",
};

const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];

// Parse duration strings (e.g. "8 Weeks", "10 Days", "2 Months") into days for consistent sorting (FR-022)
function parseDurationToDays(val) {
  if (!val) return 0;
  const str = String(val).trim().toLowerCase();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(days?|weeks?|months?|years?|hours?)?/i);
  if (match) {
    const num = parseFloat(match[1]);
    const unit = (match[2] || "").toLowerCase();
    if (unit.startsWith("day")) return num;
    if (unit.startsWith("week")) return num * 7;
    if (unit.startsWith("month")) return num * 30;
    if (unit.startsWith("year")) return num * 365;
    if (unit.startsWith("hour")) return num / 24;
    return num;
  }
  return 0;
}

// Check if course ID matches search term (supports raw ID, numbers, and padded codes like C001, C1) (FR-004)
function matchesCourseId(courseId, term) {
  if (courseId === undefined || courseId === null) return false;
  const rawIdStr = String(courseId).trim().toLowerCase();
  if (rawIdStr.includes(term)) return true;

  const numericMatch = rawIdStr.match(/\d+/);
  if (numericMatch) {
    const numVal = parseInt(numericMatch[0], 10);
    const padded3 = `c${String(numVal).padStart(3, "0")}`;
    const padded4 = `c${String(numVal).padStart(4, "0")}`;
    const prefixed = `c${numVal}`;
    const padOnly3 = String(numVal).padStart(3, "0");
    const padOnly4 = String(numVal).padStart(4, "0");

    if (
      padded3.includes(term) ||
      padded4.includes(term) ||
      prefixed.includes(term) ||
      padOnly3.includes(term) ||
      padOnly4.includes(term)
    ) {
      return true;
    }
  }

  const termDigitsMatch = term.match(/^c0*(\d+)$/);
  if (termDigitsMatch) {
    const termNum = termDigitsMatch[1];
    if (rawIdStr === termNum) return true;
  }

  return false;
}

// Load the course list.
async function fetchAllCourses() {
  const response = await api.get("/courses");
  return response.data.courses;
}

function ManageCourses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search, filter, and sorting state (CR-003)
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedLevel, setSelectedLevel] = useState("All");
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState("asc");

  // Form visibility + which course is being edited (null = adding new)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState(EMPTY_COURSE);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // ---------- Load the course list once, when the page opens ----------
  useEffect(() => {
    const loadCourses = async () => {
      try {
        setCourses(await fetchAllCourses());
      } catch (error) {
        setError(
          error.response?.data?.message ||
          "Failed to load courses"
        );
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  // ---------- Reload the list after a create / update / delete ----------
  const refreshCourses = async () => {
    setCourses(await fetchAllCourses());
  };

  // ---------- Form helpers ----------
  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData({
      ...formData,
      [name]: value,
    });

    // Clear field-level error when user starts typing in that field
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const openAddForm = () => {
    setShowForm(true);
    setEditingId(null);
    setFormData(EMPTY_COURSE);
    setFormError("");
    setFieldErrors({});
    setError("");
    setSuccess("");
  };

  const openEditForm = (course) => {
    setShowForm(true);
    setEditingId(course.id);

    // Fill the form with the existing course values.
    setFormData({
      title: course.title || "",
      category: course.category || "",
      level: course.level || "Beginner",
      duration: course.duration || "",
      price: String(course.price ?? ""),
      image: course.image || "",
      description: course.description || "",
    });

    setFormError("");
    setFieldErrors({});
    setError("");
    setSuccess("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(EMPTY_COURSE);
    setFormError("");
    setFieldErrors({});
  };

  // ---------- Create / Update ----------
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setFormError("");
    setFieldErrors({});
    setError("");
    setSuccess("");

    const coursePayload = {
      title: formData.title,
      category: formData.category,
      level: formData.level,
      duration: formData.duration,
      price: formData.price,
      image: formData.image,
      description: formData.description,
    };

    setSaving(true);

    try {
      if (editingId) {
        const response = await api.put(
          `/courses/${editingId}`,
          coursePayload
        );
        setSuccess(response.data.message);
      } else {
        const response = await api.post("/courses", coursePayload);
        setSuccess(response.data.message);
      }

      closeForm();
      await refreshCourses();
    } catch (error) {
      if (error.response?.data?.errors) {
        setFieldErrors(error.response.data.errors);
        setFormError(
          error.response.data.message || "Validation failed. Please correct the highlighted errors."
        );
      } else {
        setFormError(
          error.response?.data?.message ||
          "Could not save the course. Please try again."
        );
      }
    } finally {
      setSaving(false);
    }
  };

  // ---------- Delete ----------
  const handleDelete = async (course) => {
    const confirmed = window.confirm(
      `Delete "${course.title}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const response = await api.delete(`/courses/${course.id}`);
      setSuccess(response.data.message);
      await refreshCourses();
    } catch (error) {
      setError(
        error.response?.data?.message ||
        "Could not delete the course."
      );
    }
  };

  // ---------- Search, Filter, and Sorting (CR-003) ----------
  const categories = [
    "All",
    ...Array.from(new Set(courses.map((c) => c.category).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    ),
  ];

  const levelFilterOptions = ["All", ...LEVEL_OPTIONS];

  // Search matching across course title, category, and course ID (FR-001 - FR-006)
  const matchesSearch = (course) => {
    if (!searchTerm) return true;
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const titleMatch = Boolean(course.title && course.title.toLowerCase().includes(term));
    const categoryMatch = Boolean(course.category && course.category.toLowerCase().includes(term));
    const idMatch = matchesCourseId(course.id, term);

    return titleMatch || categoryMatch || idMatch;
  };

  // Combined filtering: search, category, and level (FR-009, FR-012, FR-013, FR-014)
  const filteredCourses = courses.filter((course) => {
    const matchesCategory =
      selectedCategory === "All" || course.category === selectedCategory;
    const matchesLevel =
      selectedLevel === "All" || course.level === selectedLevel;

    return matchesSearch(course) && matchesCategory && matchesLevel;
  });

  // Sorting across supported columns (FR-015 - FR-022)
  const sortedCourses = [...filteredCourses].sort((a, b) => {
    if (!sortColumn) return 0;

    let comparison;

    switch (sortColumn) {
      case "id": {
        const idA = Number(a.id);
        const idB = Number(b.id);
        if (!isNaN(idA) && !isNaN(idB)) {
          comparison = idA - idB;
        } else {
          comparison = String(a.id ?? "").localeCompare(String(b.id ?? ""), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }
        break;
      }

      case "title": {
        comparison = String(a.title ?? "").toLowerCase().localeCompare(
          String(b.title ?? "").toLowerCase()
        );
        break;
      }

      case "category": {
        comparison = String(a.category ?? "").toLowerCase().localeCompare(
          String(b.category ?? "").toLowerCase()
        );
        break;
      }

      case "level": {
        comparison = String(a.level ?? "").toLowerCase().localeCompare(
          String(b.level ?? "").toLowerCase()
        );
        break;
      }

      case "duration": {
        const daysA = parseDurationToDays(a.duration);
        const daysB = parseDurationToDays(b.duration);
        if (daysA !== daysB) {
          comparison = daysA - daysB;
        } else {
          comparison = String(a.duration ?? "").toLowerCase().localeCompare(
            String(b.duration ?? "").toLowerCase()
          );
        }
        break;
      }

      case "price": {
        const priceA = parseFloat(a.price) || 0;
        const priceB = parseFloat(b.price) || 0;
        comparison = priceA - priceB;
        break;
      }

      default:
        comparison = 0;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Handle column header clicks for sorting (FR-016, FR-017, FR-019)
  const handleSort = (columnKey) => {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
  };

  // Reset all search, filter, and sorting state (FR-026, FR-027, FR-028)
  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedCategory("All");
    setSelectedLevel("All");
    setSortColumn(null);
    setSortDirection("asc");
  };

  // Render sort direction indicator (FR-018)
  const renderSortIndicator = (columnKey) => {
    if (sortColumn !== columnKey) {
      return <span className="sort-indicator-inactive" aria-hidden="true">⇅</span>;
    }
    return (
      <span className="sort-indicator" aria-hidden="true">
        {sortDirection === "asc" ? " ↑" : " ↓"}
      </span>
    );
  };

  return (
    <>
      <Navbar />

      <div className="container">
        <div className="page-header">
          <div>
            <h1>Manage Courses</h1>
            <p className="page-subtitle">
              Add new courses, update the existing ones, or remove courses
              that are no longer offered.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={showForm ? closeForm : openAddForm}
          >
            {showForm ? <FaTimes /> : <FaPlus />}
            {showForm ? "Cancel" : "Add Course"}
          </button>
        </div>

        {/* ---------- Success / error messages ---------- */}
        {success && <p className="success">{success}</p>}
        {error && <p className="error">{error}</p>}

        {/* ---------- Add / Edit form ---------- */}
        {showForm && (
          <section className="section-card">
            <div className="section-card-header">
              <h2>{editingId ? "Edit Course" : "New Course"}</h2>
            </div>

            <form className="form" onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="title">Title *</label>
                  <input
                    id="title"
                    className={`input ${fieldErrors.title ? "input-error" : ""}`}
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g. React"
                  />
                  {fieldErrors.title && (
                    <span className="field-error">{fieldErrors.title}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <input
                    id="category"
                    className={`input ${fieldErrors.category ? "input-error" : ""}`}
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    placeholder="e.g. Frontend"
                  />
                  {fieldErrors.category && (
                    <span className="field-error">{fieldErrors.category}</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="level">Level *</label>
                  <select
                    id="level"
                    className={`input ${fieldErrors.level ? "input-error" : ""}`}
                    name="level"
                    value={formData.level}
                    onChange={handleChange}
                  >
                    {LEVEL_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.level && (
                    <span className="field-error">{fieldErrors.level}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="duration">Duration *</label>
                  <input
                    id="duration"
                    className={`input ${fieldErrors.duration ? "input-error" : ""}`}
                    type="text"
                    name="duration"
                    value={formData.duration}
                    onChange={handleChange}
                    placeholder="e.g. 10 Weeks"
                  />
                  {fieldErrors.duration && (
                    <span className="field-error">{fieldErrors.duration}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="price">Price (Rs.) *</label>
                  <input
                    id="price"
                    className={`input ${fieldErrors.price ? "input-error" : ""}`}
                    type="text"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="e.g. 25000"
                  />
                  {fieldErrors.price && (
                    <span className="field-error">{fieldErrors.price}</span>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="image">Image URL</label>
                <input
                  id="image"
                  className={`input ${fieldErrors.image ? "input-error" : ""}`}
                  type="text"
                  name="image"
                  value={formData.image}
                  onChange={handleChange}
                  placeholder="https://placehold.co/300x180?text=React"
                />
                {fieldErrors.image && (
                  <span className="field-error">{fieldErrors.image}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  className={`input ${fieldErrors.description ? "input-error" : ""}`}
                  rows="4"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Short summary of what students will learn."
                />
                {fieldErrors.description && (
                  <span className="field-error">{fieldErrors.description}</span>
                )}
              </div>

              {formError && <p className="error">{formError}</p>}

              <div className="form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  <FaSave />
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Course"
                      : "Create Course"}
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={closeForm}
                  disabled={saving}
                >
                  <FaTimes />
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* ---------- Search, Filter, and Sort Controls (CR-003) ---------- */}
        {!loading && courses.length > 0 && (
          <div className="filter-bar filter-bar-admin">
            <div className="form-group">
              <label htmlFor="courseSearch">Search</label>
              <input
                id="courseSearch"
                type="text"
                className="input"
                placeholder="Search by title, category, or course ID..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="categoryFilter">Category</label>
              <select
                id="categoryFilter"
                className="input"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="levelFilter">Level</label>
              <select
                id="levelFilter"
                className="input"
                value={selectedLevel}
                onChange={(event) => setSelectedLevel(event.target.value)}
              >
                {levelFilterOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group filter-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleResetFilters}
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}

        {/* ---------- Course table ---------- */}
        <section className="section-card">
          <div className="section-card-header">
            <h2>All Courses{courses.length > 0 ? ` (${courses.length})` : ""}</h2>

            <Link to="/admin/enrollments" className="link-inline">
              <FaEye /> Manage enrollments
            </Link>
          </div>

          {loading && <p className="loading">Loading courses...</p>}

          {!loading && courses.length === 0 && (
            <p className="empty">
              No courses yet. Click "Add Course" to create the first one.
            </p>
          )}

          {!loading && courses.length > 0 && (
            <>
              {/* Result counter (FR-023, AC-020) */}
              <p className="result-count">
                Showing {sortedCourses.length} of {courses.length} courses
              </p>

              {/* No results message (FR-024, AC-021) */}
              {sortedCourses.length === 0 ? (
                <p className="empty">No courses found.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="table">
                    <thead>
                      <tr>
                        <th
                          className="th-sortable"
                          onClick={() => handleSort("id")}
                          title="Sort by Course ID"
                          aria-sort={
                            sortColumn === "id"
                              ? sortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          Course ID {renderSortIndicator("id")}
                        </th>

                        <th>Image</th>

                        <th
                          className="th-sortable"
                          onClick={() => handleSort("title")}
                          title="Sort by Title"
                          aria-sort={
                            sortColumn === "title"
                              ? sortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          Title {renderSortIndicator("title")}
                        </th>

                        <th
                          className="th-sortable"
                          onClick={() => handleSort("category")}
                          title="Sort by Category"
                          aria-sort={
                            sortColumn === "category"
                              ? sortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          Category {renderSortIndicator("category")}
                        </th>

                        <th
                          className="th-sortable"
                          onClick={() => handleSort("level")}
                          title="Sort by Level"
                          aria-sort={
                            sortColumn === "level"
                              ? sortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          Level {renderSortIndicator("level")}
                        </th>

                        <th
                          className="th-sortable"
                          onClick={() => handleSort("duration")}
                          title="Sort by Duration"
                          aria-sort={
                            sortColumn === "duration"
                              ? sortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          Duration {renderSortIndicator("duration")}
                        </th>

                        <th
                          className="th-sortable"
                          onClick={() => handleSort("price")}
                          title="Sort by Price"
                          aria-sort={
                            sortColumn === "price"
                              ? sortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          Price {renderSortIndicator("price")}
                        </th>

                        <th className="table-actions-column">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {sortedCourses.map((course) => (
                        <tr key={course.id}>
                          <td>{course.id}</td>

                          <td>
                            <img
                              src={course.image}
                              alt={course.title}
                              className="table-thumb"
                            />
                          </td>

                          <td>{course.title}</td>

                          <td>{course.category}</td>

                          <td>
                            <span className="tag tag-level">
                              {course.level}
                            </span>
                          </td>

                          <td>{course.duration}</td>

                          <td>Rs. {course.price}</td>

                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="btn btn-small btn-outline"
                                onClick={() => openEditForm(course)}
                              >
                                <FaEdit />
                                Edit
                              </button>

                              <button
                                type="button"
                                className="btn btn-small btn-danger"
                                onClick={() => handleDelete(course)}
                              >
                                <FaTrash />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Footer />
    </>
  );
}

export default ManageCourses;
