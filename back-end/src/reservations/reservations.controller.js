const asyncErrorBoundary = require("../errors/asyncErrorBoundary");
const service = require("./reservations.service");

const VALID_RESERVATION_FIELDS = [
  "first_name",
  "last_name",
  "mobile_number",
  "reservation_date",
  "reservation_time",
  "people",
];

// Helper function for time validation
function validateTimeFormat(timeStr) {
  const [hour, minute] = timeStr.split(":");

  if (hour.length > 2 || minute.length > 2) {
    return false;
  }
  if (hour < 1 || hour > 23) {
    return false;
  }
  if (minute < 0 || minute > 59) {
    return false;
  }
  return true;
}

// Validation middleware
function isValidReservation(req, res, next) {
  const reservation = req.body.data;

  if (!reservation) {
    return next({ status: 400, message: `Must have data property.` });
  }

  VALID_RESERVATION_FIELDS.forEach((field) => {
    if (!reservation[field]) {
      return next({ status: 400, message: `${field} field required` });
    }

    if (field === "people" && typeof reservation[field] !== "number") {
      return next({
        status: 400,
        message: `${field} should be a number for the people field.`,
      });
    }

    if (field === "reservation_date" && !Date.parse(reservation[field])) {
      return next({ status: 400, message: `${field} is not a valid date.` });
    }

    if (field === "reservation_time") {
      if (!validateTimeFormat(reservation[field])) {
        return next({ status: 400, message: `${field} is not a valid time` });
      }
    }
  });

  next();
}

function isNotOnTuesday(req, res, next) {
  const { reservation_date } = req.body.data;
  const [year, month, day] = reservation_date.split("-");
  const date = new Date(`${month} ${day}, ${year}`);
  res.locals.date = date;
  if (date.getDay() === 2) {
    return next({ status: 400, message: "Location is closed on Tuesdays" });
  }
  next();
}

function isInTheFuture(req, res, next) {
  const date = res.locals.date;
  const today = new Date();
  if (date < today) {
    return next({
      status: 400,
      message: "Reservation date must be in the future",
    });
  }
  next();
}

function isWithinOpenHours(req, res, next) {
  const reservation = req.body.data;
  const [hour, minute] = reservation.reservation_time.split(":");
  if (
    hour < 10 ||
    hour > 21 ||
    (hour === "10" && minute < "30") ||
    (hour === "20" && minute > "30")
  ) {
    return next({
      status: 400,
      message:
        "Reservation must be made within business hours (10:30 AM - 8:30 PM).",
    });
  }
  next();
}

function hasBookedStatus(req, res, next) {
  const { status } = req.body.data;
  if (status === "seated" || status === "finished" || status === "cancelled") {
    return next({
      status: 400,
      message: `New reservation cannot have ${status} status.`,
    });
  }
  next();
}

function isValidStatus(req, res, next) {
  const VALID_STATUSES = ["booked", "seated", "finished", "cancelled"];
  const { status } = req.body.data;
  if (!VALID_STATUSES.includes(status)) {
    return next({ status: 400, message: "Status is unknown." });
  }
  next();
}

function isAlreadyFinished(req, res, next) {
  const { status } = res.locals.reservation;
  if (status === "finished") {
    return next({
      status: 400,
      message: "Cannot change a reservation with a finished status.",
    });
  }
  next();
}

const reservationExists = async (req, res, next) => {
  const { reservation_id } = req.params;
  const reservation = await service.read(reservation_id);

  if (reservation) {
    res.locals.reservation = reservation;
    return next();
  }
  next({
    status: 404,
    message: `Reservation with ID ${reservation_id} does not exist.`,
  });
};

// CRUD operations
async function list(req, res) {
  const { date, mobile_number } = req.query;
  let reservations;
  if (mobile_number) {
    reservations = await service.search(mobile_number);
  } else {
    reservations = date ? await service.listByDate(date) : await service.list();
  }
  res.json({
    data: reservations,
  });
}

async function create(req, res) {
  const reservation = req.body.data;
  const { reservation_id } = await service.create(reservation);
  reservation.reservation_id = reservation_id;
  res.status(201).json({ data: reservation });
}

async function read(req, res) {
  const reservation = res.locals.reservation;
  res.json({ data: reservation });
}

async function update(req, res) {
  const { reservation_id } = req.params;
  const { status } = req.body.data;
  const reservation = await service.update(reservation_id, status);
  res.json({ data: reservation });
}

async function modify(req, res) {
  const { reservation_id } = req.params;
  const reservation = req.body.data;
  const data = await service.modify(reservation_id, reservation);
  reservation.reservation_id = data.reservation_id;
  res.json({ data: reservation });
}

module.exports = {
  list: asyncErrorBoundary(list),
  create: [
    isValidReservation,
    isNotOnTuesday,
    isInTheFuture,
    isWithinOpenHours,
    hasBookedStatus,
    asyncErrorBoundary(create),
  ],
  read: [asyncErrorBoundary(reservationExists), asyncErrorBoundary(read)],
  update: [
    asyncErrorBoundary(reservationExists),
    isValidStatus,
    isAlreadyFinished,
    asyncErrorBoundary(update),
  ],
  modify: [
    isValidReservation,
    isNotOnTuesday,
    isInTheFuture,
    isWithinOpenHours,
    asyncErrorBoundary(reservationExists),
    hasBookedStatus,
    asyncErrorBoundary(modify),
  ],
};
